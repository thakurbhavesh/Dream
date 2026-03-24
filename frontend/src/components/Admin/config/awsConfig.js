const awsConfig = {
  region: "ap-south-1",
  buckets: [
    { name: "tmx-uploads", lifecycle: "30d" },
    { name: "tmx-archive", lifecycle: "365d" },
  ],
  iamRoles: [
    { name: "tmx-admin", permissions: ["s3:*"] },
    { name: "tmx-automations", permissions: ["sqs:SendMessage", "sns:Publish"] },
  ],
};

export default awsConfig;
