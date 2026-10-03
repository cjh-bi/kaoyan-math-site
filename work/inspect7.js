const fs=require("fs"); const p=fs.readFileSync("plan.html","utf8"); const i=p.indexOf("数学分析"); const j=p.indexOf("section", i); console.log(p.slice(j, j+1200).replace(/\s+/g," ").slice(0,1000));
