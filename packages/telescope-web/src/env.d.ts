/// <reference path="../worker-configuration.d.ts" />

declare namespace App {
  interface Locals {
    runtime?: import('@astrojs/cloudflare').Runtime<Env>;
    services: import('@/lib/storage/types').RuntimeServices;
  }
}
