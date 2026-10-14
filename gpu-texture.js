export async function loadGpuColour(T,url,renderer){
 if(typeof DecompressionStream==='undefined'||!renderer.extensions.has('WEBGL_compressed_texture_s3tc'))return null;
 const response=await fetch(url);if(!response.ok)throw Error('Colour texture is unavailable');
 const blob=await response.blob();const buffer=await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 const header=new DataView(buffer);if(header.getUint32(0,true)!==0x20534444||header.getUint32(84,true)!==0x35545844)throw Error('Invalid DDS texture');
 const width=header.getUint32(16,true),height=header.getUint32(12,true);
 const levels=[];let offset=128,w=width,h=height;for(let i=0;i<Math.max(1,header.getUint32(28,true));i++){const bytes=Math.ceil(w/4)*Math.ceil(h/4)*16;levels.push({data:new Uint8Array(buffer,offset,bytes),width:w,height:h});offset+=bytes;w=Math.max(1,w>>1);h=Math.max(1,h>>1);}
 const tex=new T.CompressedTexture(levels,width,height,T.RGBA_S3TC_DXT5_Format);
 tex.colorSpace=T.NoColorSpace;tex.minFilter=T.LinearMipmapLinearFilter;tex.magFilter=T.LinearFilter;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());tex.generateMipmaps=false;tex.flipY=false;tex.needsUpdate=true;
 return tex;
}
