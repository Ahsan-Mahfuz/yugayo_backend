/* eslint-disable @typescript-eslint/no-explicit-any */
// with version 3
import {
    S3Client,
    HeadObjectCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
dotenv.config();

// Initialize the S3 client
const s3 = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

export const deleteFileFromS3 = async (fileUrl: string) => {
    // Extract the path after the domain
    const url = new URL(fileUrl);
    const fileKey = decodeURIComponent(url.pathname.substring(1)); // remove leading '/'

    const bucket = process.env.AWS_S3_BUCKET_NAME;
    if (!bucket) {
        throw new Error('AWS_S3_BUCKET_NAME environment variable is not set');
    }

    try {
        // Check if the file exists in S3
        const headCommand = new HeadObjectCommand({
            Bucket: bucket,
            Key: fileKey,
        });

        try {
            await s3.send(headCommand);
        } catch (err: any) {
            if (err.name === 'NotFound') {
                console.log(`File ${fileKey} does not exist in S3.`);
                return;
            }
            throw err;
        }

        // Delete the file
        const deleteCommand = new DeleteObjectCommand({
            Bucket: bucket,
            Key: fileKey,
        });

        await s3.send(deleteCommand);
        console.log(`Successfully deleted ${fileKey} from S3`);
    } catch (err: any) {
        if (err.name === 'NotFound') {
            console.error(`File ${fileKey} was not found in S3.`);
        } else {
            console.error('Error deleting file from S3:', err);
        }
    }
};
