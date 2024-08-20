import {
  DeleteObjectsCommand,
  DeleteObjectsCommandOutput,
  PutObjectCommand,
  PutObjectCommandInput,
  S3Client,
  CreateMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';
import sharp from 'sharp';
import { injectable } from 'inversify';
import "reflect-metadata";
import { v4 as uuidv4 } from 'uuid';
import { Credentials } from '@aws-sdk/types';
import dotenv from 'dotenv';
import { FixedSize } from '../utils/fixed-size-image';
dotenv.config(); 
  
  @injectable()
  export class S3Service {
    s3: S3Client;
    s3Acceleration: S3Client;
    constructor() {  
      const credentials: Credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      };

      this.s3 =  new S3Client({
        region: process.env.S3_REGION,
        credentials,
        signingRegion: process.env.S3_REGION,
      });

      this.s3Acceleration = new S3Client({
        region: process.env.S3_REGION,
        credentials,
        signingRegion: process.env.S3_REGION,
        useAccelerateEndpoint: true,
      });
    }
  
    async uploadImage(
      file: Express.Multer.File,
      useWatermark = false,
    ): Promise<string> {
      const name = uuidv4();
      const now = new Date();
      const month = ('0' + (now.getMonth() + 1)).slice(-2);
      const day = ('0' + now.getDate()).slice(-2);
      const image = sharp(file.buffer);
      const metadata = await image.metadata() as any;
      const width =
        metadata.width >= FixedSize.LARGE
          ? FixedSize.LARGE
          : metadata.width >= FixedSize.MEDIUM
          ? FixedSize.MEDIUM
          : FixedSize.SMALL;     
      const buffer = useWatermark
        ? await image
            .composite([
              {
                input: `${path.resolve(__dirname)}/watermark_${width}.png`,
                gravity: 'southeast',
              },
            ])
            .withMetadata()
            .toBuffer()
        : await image.toBuffer();
      return this.pubObject({
        Body: buffer,
        Key: `${now.getFullYear()}/${month}/${day}/${name}${path.extname(
          file.originalname,
        )}`,
        ContentType: metadata.format && `image/${metadata.format.toLowerCase()}`,
      });
    }
  
    async optimizeAndUploadImage(
      file: Express.Multer.File,
      widths: FixedSize[],
      useWatermark = false,
    ): Promise<Array<string>> {
      const name = uuidv4();
      const now = new Date();
      const month = ('0' + (now.getMonth() + 1)).slice(-2);
      const day = ('0' + now.getDate()).slice(-2);
      const originalKey = `${now.getFullYear()}/${month}/${day}/${name}${path.extname(
        file.originalname,
      )}`;
      const originalImage = sharp(file.buffer);
      const metadata = await originalImage.metadata() as any;
      const width =
        metadata.width >= FixedSize.LARGE
          ? FixedSize.LARGE
          : metadata.width >= FixedSize.MEDIUM
          ? FixedSize.MEDIUM
          : FixedSize.SMALL;
      const originalBuffer = await (useWatermark
        ? originalImage.composite([
            {
              input: `${path.resolve(__dirname)}/watermark_${width}.png`,
              gravity: 'southeast',
            },
          ])
        : originalImage
      )
        .withMetadata()
        .toBuffer();
  
      const uploadPromises: Array<Promise<string>> = [
        this.pubObject({
          Body: originalBuffer,
          Key: originalKey,
          ContentType: metadata.format && `image/${metadata.format}`,
        }),
      ];
  
      await Promise.all(
        widths.map(async width => {
          let image: sharp.Sharp = sharp(file.buffer).resize(width, null, {
            fit: 'contain',
          });
          if (useWatermark) {
            image = image.composite([
              {
                input: `${path.resolve(__dirname)}/watermark_${width}.png`,
                gravity: 'southeast',
              },
            ]);
          }
          return image.toBuffer();
        }),
      ).then(buffers =>
        buffers.forEach((buffer, index) => {
          const key = `${now.getFullYear()}/${month}/${day}/${name}_${
            // eslint-disable-next-line security/detect-object-injection
            widths[index]
          }${path.extname(file.originalname)}`;
          uploadPromises.push(
            this.pubObject({
              Body: buffer,
              Key: key,
              ContentType: metadata.format && `image/${metadata.format}`,
            }),
          );
        }),
      );
  
      return Promise.all(uploadPromises);
    }
  
    async uploadFile(file: Express.Multer.File): Promise<string> {     
      const name = uuidv4();
      const now = new Date();
      const month = ('0' + (now.getMonth() + 1)).slice(-2);
      const day = ('0' + now.getDate()).slice(-2);
      const buffer = file.buffer;
  
      const pubOject = {
        Body: buffer,
        Key: `${now.getFullYear()}/${month}/${day}/${name}${path.extname(
          file.originalname,
        )}`,
        ContentType: file.mimetype,
      } as Pick<
        PutObjectCommandInput,
        'Key' | 'Body' | 'ContentType' | 'ContentDisposition'
      >;
  
      if (
        file.mimetype ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ) {
        pubOject.ContentDisposition = `attachment; filename="${encodeURIComponent(
          file.originalname,
        )}"`;
      }
      
      return this.pubObject(pubOject);
    }
  
    private async pubObject(
      input: Pick<
        PutObjectCommandInput,
        'Key' | 'Body' | 'ContentType' | 'ContentDisposition'
      >,
    ): Promise<string> {
      return this.s3
        .send(
          new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            ...input,
          }),
        )
        .then(() => {
          return `${process.env.S3_ENDPOINT}/${input.Key}`;
        });
    }
  }
  