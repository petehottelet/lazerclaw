import { S3Client, CreateBucketCommand, PutBucketCorsCommand, PutPublicAccessBlockCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3'

const BUCKET = process.env.S3_BUCKET || 'your-s3-bucket-name'
const REGION = process.env.S3_REGION || 'us-east-1'

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

async function main() {
  // 1. Create bucket
  console.log(`Creating bucket: ${BUCKET}...`)
  try {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }))
    console.log('Bucket created.')
  } catch (e) {
    if (e.name === 'BucketAlreadyOwnedByYou') {
      console.log('Bucket already exists (owned by you).')
    } else {
      throw e
    }
  }

  // 2. Disable "Block Public Access" so we can serve files publicly
  console.log('Configuring public access...')
  await s3.send(new PutPublicAccessBlockCommand({
    Bucket: BUCKET,
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: false,
      IgnorePublicAcls: false,
      BlockPublicPolicy: false,
      RestrictPublicBuckets: false,
    },
  }))

  // 3. Set bucket policy for public read
  console.log('Setting public read policy...')
  const policy = JSON.stringify({
    Version: '2012-10-17',
    Statement: [{
      Sid: 'PublicReadGetObject',
      Effect: 'Allow',
      Principal: '*',
      Action: 's3:GetObject',
      Resource: `arn:aws:s3:::${BUCKET}/*`,
    }],
  })
  await s3.send(new PutBucketPolicyCommand({ Bucket: BUCKET, Policy: policy }))

  // 4. Set CORS for browser access
  console.log('Setting CORS...')
  await s3.send(new PutBucketCorsCommand({
    Bucket: BUCKET,
    CORSConfiguration: {
      CORSRules: [{
        AllowedHeaders: ['*'],
        AllowedMethods: ['GET', 'HEAD'],
        AllowedOrigins: [
          process.env.APP_ORIGIN || 'https://your-app.vercel.app',
          'http://localhost:5173',
          'http://localhost:5174',
        ],
        MaxAgeSeconds: 86400,
      }],
    },
  }))

  console.log('Done! Bucket is ready.')
  console.log(`Public URL pattern: https://${BUCKET}.s3.${REGION}.amazonaws.com/<key>`)
}

main().catch(e => { console.error(e); process.exit(1) })
