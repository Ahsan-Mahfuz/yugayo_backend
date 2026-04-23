import { Request, Response } from "express";
import httpStatus from "http-status";


const notFound = (req:Request, res:Response)=>{
    res.status(httpStatus.NOT_FOUND).json({
        success:false,
        statusCode:httpStatus.NOT_FOUND,
        message:"Route Not Found",
    })
}
export default notFound