

// const getAdminNotificationCount = async () => {
//   const unseenCount = await Notification.countDocuments({
//     seenBy: { $eq: USER_ROLE.admin },
//     $or: [{ receiver: USER_ROLE.admin }, { receiver: 'all' }],
//   });
//   const latestNotification = await Notification.findOne({
//     $or: [{ receiver: USER_ROLE.admin }, { receiver: 'all' }],
//   })
//     .sort({ createdAt: -1 })
//     .lean();
//   return { unseenCount, latestNotification };
// };

// export default getAdminNotificationCount;
