const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config()

// middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://auth-moha-milon-a28c8.web.app',
    'https://auth-moha-milon-a28c8.firebaseapp.com'
],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser())
 

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.abrfq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// middlewares
const logger = async(req, res, next ) => {
  console.log('log: info', req.method, req.url)
  next()
}

const cookieOption = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === 'production'? 'none' : 'strict',
  secure: process.env.NODE_ENV === 'production'? true : false,
}


const veryfyToken = async(req, res, next) => {
  const token = req.cookies?.token
  console.log('value of token in middleware', token)
  if(!token){
    return res.status(401).send({message: 'Not authorized'})
  }
  
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    // error
    if(err){
      console.log(err)
      return res.status(401).send({message: 'unauthorized'})
    }
    // if token is valid it would be decoded
    console.log('value in the token', decoded)
    req.user = decoded
    next()
  })
}


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();


    const serviceCollection = client.db("carDoctor").collection("services");
    const bookingCollection = client.db("carDoctor").collection("bookings");


    // auth related api
    app.post('/jwt', logger, async(req, res) => {
      const user = req.body;
      console.log(user)
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'})

      res.cookie('token', token, cookieOption)
      .send({success: true})
    })

    app.post('/logout', async(req, res) => {
      const user = req.body
      console.log('loging out', user)
      res.clearCookie('token',{ ...cookieOption, maxAge: 0 }).send({success: true})
    })


    // services related api
    app.get('/services', logger, async (req, res) => {
        const cursor = serviceCollection.find({})
        const result = await cursor.toArray()
        res.send(result)
    })

    app.get('/services/:id', async (req, res) => {
        const id = req.params.id
        const qurey = { _id: new ObjectId(id)}

        const options = {
            projection: { title: 1, price: 1, service_id: 1, img: 1},
          };

        const result = await serviceCollection.findOne(qurey, options)
        res.send(result)
    })

    // bookings
    app.get('/bookings', logger, veryfyToken, async (req, res) => {
      console.log(req.query.email)
      console.log('user in the valid token',req.user)
      console.log('token---->', req.cookies.token)
      if(req.query.email !== req.user.email){
        return res.status(403).send({message: 'forbidden access'})
      }
      
      let query = {};
        if(req.query?.email) {
          query= { email: req.query.email }
        }
      
      const cursor = bookingCollection.find(query)
      const result = await cursor.toArray()
      res.send(result)
    })


    app.post('/bookings', async (req, res) => {
      const booking = req.body
      const result = await bookingCollection.insertOne(booking)
      res.send(result)
    })

    app.get('/bookings/:id', async(req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id)}
      const result = await bookingCollection.findOne(query)
      res.send(result)
    })

    app.patch('/bookings/:id', async (req, res) => {
      const id = req.params.id  
      const filter = { _id: new ObjectId(id)}
      const updatedBooking = req.body
      console.log(updatedBooking)
      const updateDoc = {
        $set: {
           status: updatedBooking.status
        },
      };
      const result = await bookingCollection.updateOne(filter, updateDoc)
      res.send(result)

    })
    app.delete('/bookings/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await bookingCollection.deleteOne(query)
      res.send(result)
    })



    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Car doctor is running')
})

app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})