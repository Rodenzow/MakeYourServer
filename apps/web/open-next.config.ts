import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Toutes les pages sont dynamiques (données personnelles) : pas de cache incrémental à configurer.
export default defineCloudflareConfig({});
