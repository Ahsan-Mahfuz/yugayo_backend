// /* eslint-disable @typescript-eslint/no-explicit-any */
// import axios from 'axios';
// import User from '../modules/user/user-model';

// const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID!;
// const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY!;

// type NotificationData = Record<string, any>;

// const sendNotification = async (
//     playerIds: string[],
//     title: string,
//     message: string,
//     data: NotificationData = {}
// ) => {
//     if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
//         throw new Error('Missing OneSignal credentials');
//     }

//     if (playerIds.length === 0) {
//         console.warn('No playerIds provided, skipping notification');
//         return;
//     }

//     try {
//         const response = await axios.post(
//             'https://onesignal.com/api/v1/notifications',
//             {
//                 app_id: ONESIGNAL_APP_ID,
//                 include_player_ids: playerIds,
//                 headings: { en: title },
//                 contents: { en: message },
//                 data,
//             },
//             {
//                 headers: {
//                     Authorization: `Basic ${ONESIGNAL_API_KEY}`,
//                     'Content-Type': 'application/json',
//                 },
//             }
//         );
//         return response.data;
//     } catch (error: any) {
//         console.error(
//             'Error sending OneSignal notification:',
//             error?.response?.data || error.message
//         );
//         throw error;
//     }
// };

// // Send notification to single user by userId
// export const sendSinglePushNotification = async (
//     userId: string ,
//     title: string,
//     message: string,
//     data: NotificationData = {}
// ) => {
//     const user = await User.findById(userId).select('playerIds');
//     if (!user || !user.playerIds.length) return;
//     return sendNotification(user.playerIds, title, message, data);
// };

// // Send notification to multiple users by userIds
// export const sendBatchPushNotification = async (
//     userIds: string[],
//     title: string,
//     message: string,
//     data: NotificationData = {}
// ) => {
//     const users = await User.find({ _id: { $in: userIds } }).select(
//         'playerIds'
//     );

//     const allPlayerIds = users.reduce<string[]>((acc, user) => {
//         if (user.playerIds && user.playerIds.length)
//             acc.push(...user.playerIds);
//         return acc;
//     }, []);

//     if (allPlayerIds.length === 0) return;

//     return sendNotification(allPlayerIds, title, message, data);
// };
