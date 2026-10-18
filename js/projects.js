/**
 * ============================================================================
 * NABILA LATASYA — PORTFOLIO PROJECT REPOSITORY
 * ============================================================================
 * Clean, humble, and honest descriptions of projects & internship works.
 */

const PORTFOLIO_PROJECTS = [
  {
    id: "it-helpdesk",
    title: "IT Helpdesk & Campus Network Monitoring",
    categoryTag: "Web Development & System Improvement · PTDI-STTD",
    description: "Improved an internal ticketing website using PHP and MySQL. Updated the tracking workflow, made testimonial forms appear neatly when tickets are finished, secured file uploads, and built a simple status checker to monitor campus website availability.",
    features: [
      "Updated the internal ticketing website using PHP and MySQL for campus staff and students.",
      "Refined ticket tracking workflows so users can easily follow their issue progress.",
      "Implemented a testimonial feedback mechanism that appears neatly once tickets are resolved.",
      "Secured file upload endpoints to prevent unauthorized script execution.",
      "Built a simple status checker script to monitor campus website availability and response times.",
      "Mapped campus building network topology for Ruijie equipment using MikroTik The Dude."
    ],
    technologies: ["PHP", "MySQL", "JavaScript", "Bootstrap", "cURL", "MikroTik The Dude"],
    coverImage: "assets/project-helpdesk.svg",
    images: [
      { url: "assets/project-helpdesk.svg", caption: "IT Helpdesk Portal & Campus Network Monitoring Overview" }
    ],
    github: null,
    demo: null
  },
  {
    id: "pet",
    title: "Pet Adoption Mobile App",
    categoryTag: "Mobile App Project · Personal Study",
    description: "Created an Android mobile app for pet adoption using Android Studio. Designed the user interface inspired by layouts on Pinterest and Figma, and combined open-source code components from GitHub with the help of AI tools to build custom features.",
    features: [
      "Designed clean, user-friendly mobile layouts inspired by references from Pinterest and Figma.",
      "Built native Android screens in Android Studio using Java/Kotlin.",
      "Implemented catalog browsing for adoptable pets with categories and profile details.",
      "Integrated and adapted open-source GitHub components to fit the app requirements.",
      "Leveraged AI-assisted workflows to accelerate development and refine business logic."
    ],
    technologies: ["Android Studio", "Java/Kotlin", "Figma", "UI/UX", "GitHub"],
    coverImage: "assets/project-pet.svg",
    images: [
      { url: "assets/project-pet.svg", caption: "Pet Adoption Mobile App UI Layouts & Profile Cards" }
    ],
    github: null,
    demo: null
  },
  {
    id: "attendance",
    title: "Face-Recognition Attendance System (Assisted Project)",
    categoryTag: "Academic & Internship Project · PTDI-STTD",
    description: "Assisted in testing and integrating a face-recognition attendance system for student attendance at PTDI-STTD, helping ensure reliable student check-ins and data logging.",
    features: [
      "Assisted the development team in testing real-time face verification for cadet check-ins.",
      "Observed camera stream recognition and helped identify response lag or detection issues.",
      "Supported attendance record synchronization with the local campus database.",
      "Tested edge-case conditions including varying camera angles and lighting setups."
    ],
    technologies: ["Python", "OpenCV", "Flask", "SQLite"],
    coverImage: "assets/project-k3.svg",
    images: [
      { url: "assets/project-k3.svg", caption: "Face-Recognition Attendance Verification Workflow" }
    ],
    github: null,
    demo: null
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PORTFOLIO_PROJECTS;
}
