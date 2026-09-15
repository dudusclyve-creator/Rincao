const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
p.product.findMany({where:{category:{name:'BEBIDAS'}},select:{name:true,photoUrl:true}}).then(r=>{
  r.filter(x=>x.photoUrl).slice(0,5).forEach(x=>console.log(x.name,'=>',x.photoUrl));
  p.$disconnect();
})