const express = require('express')
const cors = require('cors')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { PrismaClient } = require('@prisma/client')


const app = express()
const prisma = new PrismaClient()

const PORT = Number(process.env.PORT || 3001)


// ==============================
// Middleware
// ==============================

app.use(cors())
app.use(express.json())


// ==============================
// Upload folder
// ==============================

const UPLOAD_DIR = path.join(
  __dirname,
  'uploads'
)

fs.mkdirSync(
  UPLOAD_DIR,
  {
    recursive:true
  }
)


app.use(
  '/uploads',
  express.static(UPLOAD_DIR)
)



// ==============================
// Helper
// ==============================

function reqType(value){

  return [
    'signature',
    'stamp'
  ].includes(value)
    ? value
    : null

}




// ==============================
// Multer Configuration
// ==============================

const storage =
multer.diskStorage({

  destination:
  (_req,_file,callback)=>{

    callback(
      null,
      UPLOAD_DIR
    )

  },


  filename:
  (_req,file,callback)=>{

    const ext =
    path.extname(
      file.originalname
    ).toLowerCase()


    callback(
      null,
      `${crypto.randomUUID()}${ext}`
    )

  }

})



const upload =
multer({

  storage,


  limits:{
    fileSize:
    10 * 1024 * 1024,

    files:1
  },


  fileFilter:
  (_req,file,callback)=>{


    const allowed=[

      'image/png',

      'image/jpeg',

      'image/webp',

      'application/pdf'

    ]


    if(
      !allowed.includes(
        file.mimetype
      )
    ){

      return callback(
        new Error(
          'File harus PNG, JPG, WEBP, atau PDF'
        )
      )

    }


    callback(
      null,
      true
    )

  }

})




// ==============================
// Health Check
// ==============================

app.get(
'/api/health',
(_req,res)=>{

  res.json({
    status:'ok'
  })

})




// ==============================
// ASSET
// ==============================


app.get(
'/api/assets',
async(req,res)=>{


try{


const type =
reqType(
req.query.type
)



const assets =
await prisma.asset.findMany({

where:
type
?
{
 type
}
:
undefined,


orderBy:{
createdAt:'desc'
}


})


res.json(
assets
)


}
catch(error){

res.status(500).json({

error:error.message

})

}


})





app.post(
'/api/assets',
upload.single('file'),
async(req,res)=>{


try{


if(!req.file){

return res.status(400).json({

error:
'File gambar wajib dipilih'

})

}



const type =
reqType(
req.body.type
)



if(!type){


fs.unlinkSync(
req.file.path
)


return res.status(400).json({

error:
'Jenis asset tidak valid'

})


}




const asset = {


id:
crypto.randomUUID(),


name:
req.file.originalname,


type,


filename:
req.file.filename,


url:
`http://localhost:${PORT}/uploads/${req.file.filename}`


}



const saved =
await prisma.asset.create({

data:asset

})


res.status(201).json(
saved
)



}
catch(error){

res.status(500).json({

error:error.message

})

}


})





app.delete(
'/api/assets/:id',
async(req,res)=>{


try{


const asset =
await prisma.asset.findUnique({

where:{
id:req.params.id
}

})



if(!asset){

return res.status(404).json({

error:
'Aset tidak ditemukan'

})

}



const filePath =
path.join(
UPLOAD_DIR,
asset.filename
)



if(fs.existsSync(filePath)){

fs.unlinkSync(filePath)

}



await prisma.asset.delete({

where:{
id:req.params.id
}

})


res.status(204).end()



}
catch(error){

res.status(500).json({

error:error.message

})

}


})