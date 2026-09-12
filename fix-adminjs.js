const fs = require("fs");
let f = "C:/Users/khali/Downloads/school-management-system/app/admin/page.tsx";
let c = fs.readFileSync(f, "utf8");
// Remove the AuthGuard wrapping lines
c = c.replace('<AuthGuard permission="view_dashboard">\n        <', '<');
c = c.replace('      </AuthGuard>\n    </>\n  )', '  )');
fs.writeFileSync(f, c);
console.log("Fixed AdminDashboard");