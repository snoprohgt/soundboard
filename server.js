
const express=require("express");
const http=require("http");
const path=require("path");
const {Server}=require("socket.io");

const app=express();
const server=http.createServer(app);
const io=new Server(server,{maxHttpBufferSize: 15e6});
const rooms=new Map();

app.use(express.static(path.join(__dirname,"public")));

function code(){
  let c;
  do { c=Math.random().toString(36).slice(2,8).toUpperCase(); } while(rooms.has(c));
  return c;
}

io.on("connection",socket=>{
  socket.on("createRoom",({name},cb)=>{
    const room=code();
    rooms.set(room,{host:socket.id,users:new Map([[socket.id,name||"Hôte"]])});
    socket.join(room); socket.room=room; socket.host=true;
    socket.emit("roomCreated",{room});
    if(cb)cb({ok:true,room});
  });

  socket.on("joinRoom",({room,name},cb)=>{
    room=String(room||"").trim().toUpperCase();
    const r=rooms.get(room);
    if(!r){socket.emit("roomError","Cette salle n'existe pas.");if(cb)cb({ok:false});return;}
    r.users.set(socket.id,name||"Invité");
    socket.join(room); socket.room=room; socket.host=false;
    socket.emit("roomJoined",{room,host:false});
    if(cb)cb({ok:true,room});
  });

  socket.on("playRemoteAudio",payload=>{
    if(!socket.room || !socket.host) return;
    if(!payload || typeof payload.data!=="string") return;
    io.to(socket.room).emit("playRemoteAudio",{name:payload.name||"Son",data:payload.data});
  });

  socket.on("disconnect",()=>{
    if(!socket.room)return;
    const r=rooms.get(socket.room);
    if(!r)return;
    r.users.delete(socket.id);
    if(r.host===socket.id){
      const next=r.users.keys().next().value;
      if(next){
        r.host=next;
        const s=io.sockets.sockets.get(next);
        if(s){s.host=true;s.emit("roomJoined",{room:socket.room,host:true});}
      } else rooms.delete(socket.room);
    }
  });
});

const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log(`Remote Soundboard: http://localhost:${PORT}`));
