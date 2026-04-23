/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Request } from 'express';
import multer from 'multer';
import fs from 'fs';
export const uploadFile = () => {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      let uploadPath = '';

      if (file.fieldname === 'profile_image') {
        uploadPath = 'uploads/images/profile';
      } else if (file.fieldname === 'post_images') {
        uploadPath = 'uploads/images/post_images';
      } else if (file.fieldname === 'badge_image') {
        uploadPath = 'uploads/images/badge_images';
      } else if (file.fieldname === 'battle_images') {
        uploadPath = 'uploads/images/battle_images';
      } else if (file.fieldname === 'monster_image') {
        uploadPath = 'uploads/images/monster_image';
      } else {
        uploadPath = 'uploads';
      }

      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }

      if (
        file.mimetype === 'image/jpeg'||
        file.mimetype === 'image/png' ||
        file.mimetype === 'image/jpg' ||
        file.mimetype === 'image/webp' 
      ) {
        cb(null, uploadPath);
      } else {
        //@ts-ignore
        cb(new Error('Invalid file type'));
      }  
    },
    filename: function (req, file, cb) {
      const name = Date.now() + '-' + file.originalname;
      cb(null, name);
    },
  });

  const fileFilter = (req: Request, file: any, cb: any) => {
    const allowedFieldNames = [
      'profile_image',
      'post_images',
      'battle_images',
      'badge_image',
      'monster_image',
    ];

    if (file.fieldname === undefined) {
      // Allow requests without any files
      cb(null, true);
    } else if (allowedFieldNames.includes(file.fieldname)) {
      if (
        file.mimetype === 'image/jpeg' ||
        file.mimetype === 'image/png' ||
        file.mimetype === 'image/jpg' ||
        file.mimetype === 'image/webp'
      ) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type'));
      }
    } else {
      cb(new Error('Invalid fieldname'));
    }
  };

  const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
  }).fields([
    { name: 'profile_image', maxCount: 1 },
    { name: 'post_images', maxCount: 5 },
    { name: 'battle_images', maxCount: 1 },
    { name: 'badge_image', maxCount: 1 },
    { name: 'monster_image', maxCount: 1 }
  ]); 

  return upload;
};
