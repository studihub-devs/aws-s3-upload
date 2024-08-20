import to from 'await-to-js';
import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { S3Service } from '../services/s3-service';
import { FixedSize } from '../utils/fixed-size-image';

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fieldSize: 1,
    files: 1,
  },
});


const singleUploadHandler = async (req: Request, res: Response): Promise<void> => {
  const start = +new Date(); 

  upload.fields([
    {
      name: 'file',
      maxCount: 1,
    },
    {
      name: 'fileExcel',
      maxCount: 1,
    },
    { name: 'video', maxCount: 1 },
  ])(req, res, async error => {
    if (error) {
      res.status(400).send({
        message: `${error}`,
      });
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };        

    const s3Service: S3Service =new S3Service();
    const isResponsive = 'false' !== req.query.isResponsive;
    const useWatermark = undefined !== req.query.useWatermark;    
    
    let image: string | undefined;
    let uploadError: Error | null;
    let originalName = '';
    if ('file' in files && files['file'][0].mimetype == 'image/gif') {
      const file = files['file'][0];
      originalName = file.originalname;
      [uploadError, image] = await to(s3Service.uploadFile(file));
    } else if (isResponsive) {
      if (files['video']) {
        const file = files['video'][0];
        originalName = file.originalname;
        [uploadError, image] = await to(s3Service.uploadFile(file));
      } else if (files['fileExcel']) {
        const file = files['fileExcel'][0];
        originalName = file.originalname;
        [uploadError, image] = await to(s3Service.uploadFile(file));
      } else {       
        const file = files['file'][0];
        originalName = file.originalname;        
        [uploadError, image as unknown as string[] | undefined] = await to(
          s3Service.optimizeAndUploadImage(
            file,
            [FixedSize.SMALL, FixedSize.MEDIUM, FixedSize.LARGE],
            useWatermark,
          ),
        );
        const end = +new Date();
        console.log(
          "Total request's time final 1: " + (end - start) + ' milliseconds',
        );
      }
    } else {      
      const file = files['file'][0];
      originalName = file.originalname;

      [uploadError, image] = await to(
        s3Service.uploadImage(file, useWatermark),
      );
    }

    if (uploadError) {
      console.log("error:", uploadError)
      res.status(500).send({
        message: `${uploadError.message}`,
      });
      return;
    }

    const resJSON = {
      name: originalName,
      url: image,
    };
    res.status(200).send(resJSON);
    
  });
};

export const uploadRouter = express
  .Router()
  .post('/single-upload', singleUploadHandler)
  // .post('/multiple-upload', multipleUploadImg);
