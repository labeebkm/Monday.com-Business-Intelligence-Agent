/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_DEALS_BOARD_ID: process.env.DEALS_BOARD_ID,
    NEXT_PUBLIC_WORK_ORDERS_BOARD_ID: process.env.WORK_ORDERS_BOARD_ID,
  }
};

export default nextConfig;

