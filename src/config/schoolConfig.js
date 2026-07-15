const SCHOOL = {
  name: "Safe Wheels Driving School",
  shortName: "DriveSchool",
  address: "123, Driving Academy Road, Near City Square, Mumbai - 400001",
  phone: "+91 98765 43210",
  email: "info@safewheels.com",
  studentIdPrefix: "DS",
  currency: "Rs. ",
  locale: "en-IN",
  whatsappMessage: (name) =>
    `Hello ${name}, you visited our driving school a few days ago. Are you still interested in joining our driving course?`,
  courses: [
    { id: "Two Wheeler Training Only", label: "Two Wheeler Training Only", duration: "15 Days", totalClasses: "15", classDuration: "30 Minutes", price: 3000 },
    { id: "Two Wheeler Training + License", label: "Two Wheeler Training + License", duration: "15 Days", totalClasses: "15", classDuration: "30 Minutes", price: 5000 },
    { id: "Four Wheeler Training Only", label: "Four Wheeler Training Only", duration: "30 Days", totalClasses: "30", classDuration: "30 Minutes", price: 5000 },
    { id: "Four Wheeler Training + License", label: "Four Wheeler Training + License", duration: "30 Days", totalClasses: "30", classDuration: "30 Minutes", price: 7000 },
  ],
};

const COURSE_TOTAL_CLASSES = {};
SCHOOL.courses.forEach((c) => { COURSE_TOTAL_CLASSES[c.id] = parseInt(c.totalClasses); });

export { SCHOOL, COURSE_TOTAL_CLASSES };
