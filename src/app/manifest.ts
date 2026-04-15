import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jgoalz Sports",
    short_name: "Jgoalz",
    description: "Jgoalz Sports — women's and girls sports registration",
    start_url: "/portal",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#7c3aed",
  };
}
