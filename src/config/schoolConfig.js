const SCHOOL = {
  name: "NEW BHARATIS MOTOR DRIVING SCHOOL",
  shortName: "Bhartis",
  address: "Near Phule Nagar Corner, Vadgaon BK, Pune - 411041",
  phone: "+91 86007 81044",
  email: "newbharatisdrivingschool@gmail.com",
  ownerPhone: "9762222203",
  studentIdPrefix: "DS",
  branchPrefixes: {
    branch_dhayari: "DH",
    branch_kirkatwadi: "KW",
    branch_vadgaon: "VG",
  },
  branchAddresses: {
    Dhayari: "Shop No 01, NEW BHARATIS MOTOR DRIVING SCHOOL, Galaxy Corner, S No 12/2A/1/16, near Kailas jeevan, Sterling Nisarga II, Dhayari, Pune, Maharashtra 411041",
    Kirkatwadi: "BHARATIS MOTOR DRIVING SCHOOL, Kolhewadi, Pune, Maharashtra 411024",
    Vadgaon: "SHOP NO 02 S NO 55, NEW BHARATIS MOTOR DRIVING SCHOOL, SADHANA ARKED, 56/1/1, Kudale Baug, Vadgaon Budruk, Pune, Maharashtra 411041",
  },
  currency: "Rs. ",
  locale: "en-IN",
  whatsappMessage: (name) =>
    `Hello ${name}, you visited NEW BHARATIS MOTOR DRIVING SCHOOL a few days ago. Are you still interested in joining our driving course?`,
  courses: [
    { id: "Two Wheeler Training Only", label: "Two Wheeler Training Only", duration: "15 Days", totalClasses: "15", classDuration: "30 Minutes", price: 3000 },
    { id: "Two Wheeler Training + License", label: "Two Wheeler Training + License", duration: "15 Days", totalClasses: "15", classDuration: "30 Minutes", price: 5000 },
    { id: "Four Wheeler Training Only", label: "Four Wheeler Training Only", duration: "30 Days", totalClasses: "30", classDuration: "30 Minutes", price: 5000 },
    { id: "Four Wheeler Training + License", label: "Four Wheeler Training + License", duration: "30 Days", totalClasses: "30", classDuration: "30 Minutes", price: 7000 },
  ],
};

const COURSE_TOTAL_CLASSES = {};
SCHOOL.courses.forEach((c) => { COURSE_TOTAL_CLASSES[c.id] = parseInt(c.totalClasses); });

const TRAINING_DAYS = 25;
const VALIDITY_DAYS = 40;

export function getCourseTotalClasses(courseId, override) {
  if (override) return Number(override);
  return COURSE_TOTAL_CLASSES[courseId] || TRAINING_DAYS;
}

export { SCHOOL, COURSE_TOTAL_CLASSES, TRAINING_DAYS, VALIDITY_DAYS };
