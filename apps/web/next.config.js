/** @type {import('next').NextConfig} */
const { loadEnvConfig } = require("@next/env");
const path = require("path");

loadEnvConfig(path.join(__dirname, "../.."));

const nextConfig = {};

module.exports = nextConfig;
