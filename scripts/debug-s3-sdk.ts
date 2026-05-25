import 'dotenv/config'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

async function main() {
  console.log(
    'AWS_ACCESS_KEY_ID:',
    process.env.AWS_ACCESS_KEY_ID
      ? `${process.env.AWS_ACCESS_KEY_ID.slice(0, 10)}...`
      : '(missing)',
  )
  console.log(
    'AWS_SECRET_ACCESS_KEY:',
    process.env.AWS_SECRET_ACCESS_KEY ? '(present)' : '(missing)',
  )
  console.log('AWS_S3_REGION:', process.env.AWS_S3_REGION)
  console.log('AWS_S3_BUCKET:', process.env.AWS_S3_BUCKET)

  const client = new S3Client({
    region: 'eu-west-2',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })

  const r = await client.send(
    new PutObjectCommand({
      Bucket: 'vence-uploads',
      Key: 'debug-sdk.txt',
      Body: 'hello sdk',
      ContentType: 'text/plain',
    }),
  )
  console.log('SDK upload OK:', r.ETag)
}

main().catch((e) => {
  console.error('ERROR:', e)
  process.exit(1)
})
