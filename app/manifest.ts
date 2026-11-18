import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "RMS",
        short_name: "RMS",
        description: "Personal content management.",
        start_url: "/",
        display: "standalone",
        background_color: "#FFFFFF",
        theme_color: "#14140F",
        orientation: "portrait",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
    };
}