/* eslint-disable @typescript-eslint/no-explicit-any */


import nodemailer from 'nodemailer';
import config from '../config';

const currentDate = new Date();

const formattedDate = currentDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

const sendEmail = async (options: {
    email: string;
    subject: string;
    html: any;
}) => {

    try {
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: parseInt(config.smtp.smtp_port as string),
            secure: true,
            auth: {
                user: config.smtp.smtp_mail,
                pass: config.smtp.smtp_pass,
            },
        });
        // console.log("options", options);

        const { email, subject, html } = options;

        const mailOptions = {
            from: `${config.smtp.name} <${config.smtp.smtp_mail}>`,
            to: email,
            date: formattedDate,
            signed_by: 'bdCalling.com',
            subject,
            html,
        };

        await transporter.sendMail(mailOptions);
    } catch (err) {
        console.log('Email not sent', err);
    }
};

export default sendEmail;
