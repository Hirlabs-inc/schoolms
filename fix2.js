const fs = require("fs");
let f = "C:/Users/khali/Downloads/school-management-system/app/admin/page.tsx";
let c = fs.readFileSync(f, "utf8");
// Remove the empty <></> fragment and fix the structure
c = c.replace("<>", "");
c = c.replace("\n        <div className=\"grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6\">", "<div className=\"grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6\">");
c = c.replace("\n        </>", "\n  )");
fs.writeFileSync(f, c);
console.log("Fixed AdminDashboard fragment");