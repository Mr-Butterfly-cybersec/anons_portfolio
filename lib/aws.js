import {
  EC2Client,
  RunInstancesCommand,
  DescribeInstancesCommand,
  TerminateInstancesCommand,
  CreateTagsCommand,
  waitUntilInstanceRunning,
} from "@aws-sdk/client-ec2";

const REQUIRED = [
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "CTF_AMI_ID",
  "CTF_SUBNET_ID",
  "CTF_SECURITY_GROUP_ID",
  "CTF_USERNAME",
  "CTF_PASSWORD",
];

export const TAG_KEY_CTF = "CTF";
export const TAG_VALUE_CTF = "anonymous4140p";
export const TAG_KEY_LAST_SEEN = "CTF_LastSeen";
export const TAG_KEY_SESSION = "Session";

export function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
}

export function ec2Client() {
  return new EC2Client({
    region: env("AWS_REGION"),
    credentials: {
      accessKeyId: env("AWS_ACCESS_KEY_ID"),
      secretAccessKey: env("AWS_SECRET_ACCESS_KEY"),
    },
  });
}

export function validateAwsConfig() {
  for (const name of REQUIRED) env(name);
}

export function getStaleThresholdMs() {
  const ms = parseInt(process.env.CTF_STALE_MS || "60000", 10);
  return Number.isNaN(ms) || ms <= 0 ? 60000 : ms;
}

export function generateSessionId() {
  return (
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36).slice(-6)
  );
}

function findActiveInstanceTags(tags) {
  const get = (key) => tags.find((t) => t.Key === key)?.Value;
  return {
    lastSeen: parseInt(get(TAG_KEY_LAST_SEEN) || "0", 10),
    session: get(TAG_KEY_SESSION) || "",
  };
}

/**
 * Find the currently active CTF instance (tagged CTF=anonymous4140p
 * and in running or pending state). Returns the instance object or null.
 */
export async function findActiveInstance() {
  validateAwsConfig();

  const client = ec2Client();
  const result = await client.send(
    new DescribeInstancesCommand({
      Filters: [
        { Name: `tag:${TAG_KEY_CTF}`, Values: [TAG_VALUE_CTF] },
        {
          Name: "instance-state-name",
          Values: ["running", "pending"],
        },
      ],
    })
  );

  const all = [];
  for (const reservation of result.Reservations || []) {
    for (const instance of reservation.Instances || []) {
      const { lastSeen, session } = findActiveInstanceTags(
        instance.Tags || []
      );
      all.push({
        instanceId: instance.InstanceId,
        state: instance.State?.Name || "unknown",
        publicIp: instance.PublicIpAddress || "",
        lastSeen,
        session,
        launchTime: instance.LaunchTime,
      });
    }
  }

  if (all.length === 0) return null;

  // Prefer the most recently launched instance
  all.sort((a, b) => {
    if (a.launchTime && b.launchTime) {
      return new Date(b.launchTime) - new Date(a.launchTime);
    }
    return 0;
  });

  return all[0];
}

/**
 * Terminate an instance by ID.
 * The IAM policy only allows termination of instances tagged
 * CTF=anonymous4140p, so this is safe by design.
 */
export async function terminateVm(instanceId) {
  validateAwsConfig();

  await ec2Client().send(
    new TerminateInstancesCommand({ InstanceIds: [instanceId] })
  );

  return { instanceId, state: "shutting-down" };
}

/**
 * Update the CTF_LastSeen tag on an instance.
 * Called by the frontend every 30s via the heartbeat endpoint.
 */
export async function heartbeat(instanceId) {
  validateAwsConfig();

  const now = Date.now();

  await ec2Client().send(
    new CreateTagsCommand({
      Resources: [instanceId],
      Tags: [{ Key: TAG_KEY_LAST_SEEN, Value: String(now) }],
    })
  );

  return { instanceId, lastSeen: now };
}

/**
 * Full lifecycle: check for an active instance, terminate if stale,
 * then launch a fresh one tagged for the CTF challenge.
 *
 * Returns an object shaped for the frontend:
 *   - { occupied: true }            — a fresh instance is already running
 *   - { instanceId, state, publicIp, username, password, sessionId } — ready
 */
export async function createVm() {
  validateAwsConfig();

  const client = ec2Client();

  // 1. Find active CTF instance
  const active = await findActiveInstance();

  if (active) {
    const threshold = getStaleThresholdMs();
    const isFresh = Date.now() - active.lastSeen < threshold;

    if (isFresh) {
      // 2a. Active + fresh → occupied
      return { occupied: true, instanceId: active.instanceId };
    }

    // 2b. Active + stale → terminate it and launch a new one
    await terminateVm(active.instanceId);
  }

  // 3. RunInstances
  const sessionId = generateSessionId();
  const now = String(Date.now());

  const runParams = {
    ImageId: env("CTF_AMI_ID"),
    InstanceType: process.env.INSTANCE_TYPE || "t3.micro",
    MinCount: 1,
    MaxCount: 1,
    NetworkInterfaces: [
      {
        DeviceIndex: 0,
        SubnetId: env("CTF_SUBNET_ID"),
        Groups: [env("CTF_SECURITY_GROUP_ID")],
        AssociatePublicIpAddress: true,
      },
    ],
    TagSpecifications: [
      {
        ResourceType: "instance",
        Tags: [
          { Key: "Name", Value: "BLACKBOX-EPHEMERAL" },
          { Key: "ManagedBy", Value: "vercel-blackbox" },
          { Key: TAG_KEY_CTF, Value: TAG_VALUE_CTF },
          { Key: TAG_KEY_SESSION, Value: sessionId },
          { Key: TAG_KEY_LAST_SEEN, Value: now },
        ],
      },
    ],
  };

  if (process.env.CTF_KEY_NAME) {
    runParams.KeyName = env("CTF_KEY_NAME");
  }

  const result = await client.send(new RunInstancesCommand(runParams));
  const instance = result.Instances?.[0];

  if (!instance?.InstanceId) {
    throw new Error("AWS did not return an instance ID.");
  }

  const instanceId = instance.InstanceId;

  // 4. Wait for the instance to reach the "running" state
  const waiterResult = await waitUntilInstanceRunning(
    { client, maxWaitTime: 120, minDelay: 5, maxDelay: 10 },
    { InstanceIds: [instanceId] }
  );

  // The waiter only reports state, not the public IP.
  // Do a fresh DescribeInstances to get the full record.
  const vm = await getVm(instanceId);

  if (waiterResult.state !== "SUCCESS") {
    // Timed out or failed — let the frontend poll via the status endpoint.
    return {
      instanceId,
      state: "booting",
      publicIp: "",
      username: env("CTF_USERNAME"),
      password: env("CTF_PASSWORD"),
      sessionId,
    };
  }

  // 5. Return connection info
  return {
    instanceId,
    state: vm.publicIp ? "running" : "booting",
    publicIp: vm.publicIp || "",
    username: env("CTF_USERNAME"),
    password: env("CTF_PASSWORD"),
    sessionId,
  };
}

/**
 * Get instance details by ID.
 */
export async function getVm(instanceId) {
  validateAwsConfig();

  const result = await ec2Client().send(
    new DescribeInstancesCommand({ InstanceIds: [instanceId] })
  );

  const instance = result.Reservations?.[0]?.Instances?.[0];

  if (!instance) {
    throw new Error("Instance not found.");
  }

  return {
    instanceId: instance.InstanceId,
    state: instance.State?.Name || "unknown",
    publicIp: instance.PublicIpAddress || "",
  };
}
