const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
p.product.findMany({where:{category:{name:'BEBIDAS'}},select:{name:true,photoUrl:true,description:true}}).then(r=>{
  r.forEach(x=>console.log(x.name,'|',x.photoUrl?'TEM FOTO':'SEM FOTO','|',x.description?'TEM DESC':'SEM DESC'));
  p.$disconnect();
})