
//dependencies for each module used
var express = require('express');
var passport = require('passport');
var InstagramStrategy = require('passport-instagram').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy; //ADDED
var http = require('http');
var path = require('path');
var handlebars = require('express-handlebars');
var bodyParser = require('body-parser');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var dotenv = require('dotenv');
var Instagram = require('instagram-node-lib');
var graph = require('fbgraph');
var mongoose = require('mongoose');
var app = express();
var brokenMusicLink ='https://fbcdn-profile-a.akamaihd.net/hprofile-ak-xaf1/v/t1.0-1/417197_10149999285992991_711134825_n.png?oh=5f504d85a96f2380b2e321d724d15511&oe=55DC0D22&__gda__=1435991238_9b0901b9ebd35182a3dccd793d453e0b';
//local dependencies
var models = require('./models');

//client id and client secret here, taken from .env
dotenv.load();
var INSTAGRAM_CLIENT_ID="68b395acd16f4d64921ba340b243eb22";
var INSTAGRAM_CLIENT_SECRET="24fe9758adb745c9a81d252d467c2538";
var INSTAGRAM_CALLBACK_URL="http://hanahappiness.herokuapp.com/auth/instagram/callback";

var MONGODB_CONNECTION_URL  = "mongodb://Wendy_COGS:f4p_CM6S@ds061621.mongolab.com:61621/mydb";

var INSTAGRAM_ACCESS_TOKEN = "";
Instagram.set('client_id', INSTAGRAM_CLIENT_ID);
Instagram.set('client_secret', INSTAGRAM_CLIENT_SECRET);

var FACEBOOK_APP_ID = "1037035612991295";
var FACEBOOK_APP_SECRET = "a7f5db616a09e29c1433eb0877e1c216";
var conf = {
   client_id: '1037035612991295',
   client_secret: 'a7f5db616a09e29c1433eb0877e1c216',
   scope: 'public_profile, user_friends,user_likes,user_status, user_posts,user_photos,user_about_me',
   redirect_uri: 'http://hanahappiness.herokuapp.com/auth/facebook/callback'
};


//connect to database
mongoose.connect(MONGODB_CONNECTION_URL);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function(callback) {
   console.log("Database connected succesfully.");
});

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Instagram profile is
//   serialized and deserialized.
passport.serializeUser(function(user, done) {
   done(null, user);
});
passport.deserializeUser(function(obj, done) {
   done(null, obj);
});

passport.use(new InstagramStrategy({
      clientID: INSTAGRAM_CLIENT_ID,
      clientSecret: INSTAGRAM_CLIENT_SECRET,
      callbackURL: INSTAGRAM_CALLBACK_URL
   },
   function(accessToken, refreshToken, profile, done) {
      // asynchronous verification, for effect...
      models.User.findOrCreate({
         "name": profile.username,
         "id": profile.id,
         "access_token": accessToken
      }, function(err, user, created) {

         // created will be true here
         models.User.findOrCreate({}, function(err, user, created) {
            // created will be false here 
            process.nextTick(function() {
               return done(null, profile);
            });
         })
      });
   }
));

passport.use(new FacebookStrategy({
      clientID: "1037035612991295",
      clientSecret: "a7f5db616a09e29c1433eb0877e1c216",
      callbackURL: "http://hanahappiness.herokuapp.com/auth/facebook/callback"
   },
   function(accessToken, refreshToken, profile, done) {
      // asynchronous verification, for effect...
      // created will be false here 

      models.User.findOrCreate({
         "name": profile.username,
         "id": profile.id,
         "access_token": accessToken
      }, function(err, user, created) {

         // created will be true here
         models.User.findOrCreate({}, function(err, user, created) {

            process.nextTick(function() {
               graph.setAccessToken(accessToken);
               return done(null, profile);
            });
         })
      });
   }
));

//Configures the Template engine
app.engine('handlebars', handlebars({
   defaultLayout: 'layout'
}));
app.set('view engine', 'handlebars');
app.set('views', __dirname + '/views');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({
   extended: false
}));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({
   secret: 'keyboard cat',
   saveUninitialized: true,
   resave: true
}));
app.use(passport.initialize());
app.use(passport.session());

//set environment ports and start application
app.set('port', process.env.PORT || 3000);

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
   if (req.isAuthenticated()) {
      return next();
   }
   res.redirect('/login');
}


//routes

app.get('/', function(req, res) {
   res.redirect('/login');
});


app.get('/login', function(req, res) {
   var onepicture = "";

   Instagram.media.popular({
      complete: function(data) {
         //Map will iterate through the returned data obj
         onepicture = data[0].images.low_resolution.url;
         renderReturn(onepicture);
         return;
      }
   })

   function renderReturn(onepicture) {
      if (req.user == null)
         return res.render('login', {
            user: req.user,
            onepicture: onepicture
         });
      if (req.user.provider == 'instagram' && (req.user != null)) {
         var query = models.User.where({
            name: req.user.username
         });
         query.findOne(function(err, user) {
            if (err) return handleError(err);
            if (user) {
               Instagram.users.info({
                  user_id: user.id,
                  access_token: user.access_token,
                  // user_id:req.user.id,
                  complete: function(data) {
                     var user_profilePicture = data.profile_picture;
                     var firstName = data.full_name.substr(0, data.full_name.indexOf(' '));
                     res.render('login', {
                        user: req.user,
                        user_profilePicture: user_profilePicture,
                        onepicture: onepicture
                     });
                  }
               });
            }
         });
      } //if ends 

      if (req.user.provider === 'facebook' && (req.user != null)) {
         graph.get("/me?fields=picture.type(large)", /*'/me?fields=id,name,picture,friends'*/ function(err, res2) {
            res.render('login', {
               user: req.user,
               user_profilePicture: res2.picture.data.url,
               onepicture: onepicture
            });
         });
      }
   }
});
app.get('/account', ensureAuthenticated, function(req, res) {

   if (req.user.provider == "instagram") {
      var query = models.User.where({
         name: req.user.username
      });
      query.findOne(function(err, user) {
         if (err) return handleError(err);
         if (user) {
            Instagram.users.info({
               user_id: user.id,
               access_token: user.access_token,
               // user_id:req.user.id,
               complete: function(data) {
                  var user_profilePicture = data.profile_picture;
                  var firstName = data.full_name.substr(0, data.full_name.indexOf(' '));
                  res.render('account', {
                     user: req.user,
                     user_profilePicture: user_profilePicture,
                     firstName: firstName
                  });
               }
            });
         }
      });
   }
   //instagram if ends
   if (req.user.provider == "facebook") {

      graph.get("/me?fields=picture.type(large),first_name", function(err, res2) {
         res.render('account', {
            user: req.user,
            user_profilePicture: res2.picture.data.url,
            firstName: res2.first_name
         });
      });


   }



});

app.get('/facebook', ensureAuthenticated, function(req, res) {
   if(req.user.provider != "facebook")   {res.redirect('/login');
   return;}

   graph.get("/me?fields=picture.type(large),photos,first_name", /*'/me?fields=id,name,picture,friends'*/ function(err, res2) {
      var user_profilePicture = res2.picture.data.url;
      var first_name = res2.first_name;
      
      var userPhotos=[];
  
      if(res2.photos!=null){
      for(var i5=0;i5<res2.photos.data.length;i5++){
      if(res2.photos.data[i5] == null){
      userPhotos.push(
      {
         photourl:res2.photos.data[i5].images[1].source,
                  photoLink:res2.photos.data[i5].link,
                  photoLikes:0,
      });
      }
      else{
      userPhotos.push(
      {
         photourl:res2.photos.data[i5].images[1].source,
         photoLink:res2.photos.data[i5].link,
         photoLikes:res2.photos.data[i5].likes.data.length
      });
     }
     }}

      graph.get("/me/statuses", function(err, res1) {

         var res1 = res1;
         var messageArr = [];

         if(res1.data.length>0){
         for (var i = 0; i < res1.data.length; i++) {
             if(res1.data[i].likes == null){
            messageArr.push({
                message: res1.data[i].message,
               totalLikes:0,
            });
             }
             else{
            messageArr.push({
                message: res1.data[i].message,
               totalLikes:res1.data[i].likes.data.length 
            });}//else
         }}//if ends

         res.render('facebook', {
           res2Photos: res2.photos,
            user: req.user,
            res1: res1,
            facebook: messageArr,
            facebookData:res1.data[0],
            userPhotos:userPhotos,
            user_profilePicture: user_profilePicture,first_name:first_name
         });
      });
   }); //graph outer
});



app.get('/love', function(req, res) {
   graph.setAccessToken('1037035612991295|Evyk6CopDTyeNmuey1VCGiWMnDc');
   graph.get("search?q=beach+san_diego&type=page&center=32.7150,-117.1625&distance=50000&limit=100000", function(err, res2) {

         var location = [];

         for (var i = 0; i < res2.data.length; i++) {
            location.push({
               url: res2.data[i].id,
            })
         };

         var locationINFO = [];
   
var i3=0;
        
         for (var i2 = 0; i2 < location.length; i2++) {

   
            graph.get("/" + location[i2].url + "?fields=description,checkins,likes,were_here_count,name,picture.type(large).width(600),link", function(err, res3) {
                  var locationPicurl;
var a ="false";

           if ((res3.picture.data.width >= 400)&&(res3.picture.data.url!=brokenMusicLink)&&(res3.picture.data.url!='https://fbcdn-profile-a.akamaihd.net/hprofile-ak-xaf1/v/t1.0-1/418333_10149999285994467_1920585607_n.png?oh=7d32e7fdad9c6cf1b0333b05245feb91&oe=55D6492D&__gda__=1437280202_44cc3d9bbdc89cc4cc03a2ba3548da54')&&(res3.picture.data.url!='https://fbcdn-profile-a.akamaihd.net/hprofile-ak-ash2/v/t1.0-1/580798_10149999285995853_2130804811_n.png?oh=9d7c86b0f9b8d44f5140c79d8aa42b58&oe=5598A65F&__gda__=1436073212_5d1ecfb4933036d57c1f4e9a36983d60')&&(res3.picture.data.url != 'https://fbcdn-profile-a.akamaihd.net/hprofile-ak-xaf1/v/t1.0-1/418333_10149999285994467_1920585607_n.png?oh=56f79c7d99c8953b1d3d458b592706d6&oe=55AEBC2D&__gda__=1437280202_85508750ff88cded83a455f528cf0a18'))
                     {
                     locationPicurl = res3.picture.data.url;
                 i3++;
                   a ="true";       
                   }
                if (a == "true") 
                  var b =locationINFO.push({
                     locationurl: res3.link,
                     locationDescription: res3.description,
                     locationCheckins: res3.checkins,
                     locationLike: res3.likes,
                     locationWereHere: res3.were_here_count,
                     locationName: res3.name,
                     locationPic: locationPicurl
                  }); 
                   i2--;
                  if (i2==1) {
                       locationInFO = locationINFO.sort(
                           function(a, b){
                          var keyA = a.locationWereHere,
                          keyB = b.locationWereHere;
                            // Compare the 2 dates
                               if(keyA < keyB) return 1;
                              if(keyA > keyB) return -1;
                                     return 0;
                             }
                        );
                      
                     arr(locationINFO);
                     return;
                  }
               }) //graphinner

         };

         function arr(data2) {

            res.render('love', {
               res2: res2,
               location: data2
            });
         }
      }) //graph
});



app.get('/popular', function(req, res) {

   Instagram.media.popular({
      complete: function(data) {
         //Map will iterate through the returned data obj
         var onepicture = data[1].images.low_resolution.url;
         var imageArr = data.map(function(item) {
            //create temporary json object
            tempJSON = [];
            //check whether the caption is null
            if (item.caption) {
               tempJSON.caption2 = item.caption.text;
            } else
               tempJSON.caption2 = " ";
            tempJSON.url = item.images.low_resolution.url;
            return tempJSON;
         });

         res.render('popular', {
            photos: imageArr,
            onepicture: onepicture
         });
      }
   });
});


app.get('/instagram', ensureAuthenticated, function(req, res) {
      if(req.user.provider != "instagram")   
         {res.redirect('/login');
         return;
      }
   var query = models.User.where({
      name: req.user.username
   });

   query.findOne(function(err, user) {
      if (err) return handleError(err);
      if (user) {
         // doc may be null if no document matched
         var user_profilePicture = "";
         Instagram.users.self({
            access_token: user.access_token,
            count: 200,
            // user_id:req.user.id,
            complete: function(data) {
            
               //Map will iterate through the returned data obj
         
               
               if(data[0]!=null){
               var imageArr = data.map(function(item) {
                  //create temporary json object
                  tempJSON = [];
                  tempJSON.url2 = item.images.low_resolution.url;
                  if(item.caption!=null)
                  tempJSON.pp = item.caption.text;
                  else
                       tempJSON.pp = " ";

                  tempJSON.the_profilePicture = item.user.profile_picture;
            
                  if(item.likes!=null)
                  tempJSON.numLikes = item.likes.count;
                   else
                       tempJSON.numLikes = 0;
                  return tempJSON;
               });
               }

               Instagram.users.info({
                  user_id: user.id,
                  access_token: user.access_token,
                  complete: function(data2) {
                     user_profilePicture = data2.profile_picture;
                     res.render('instagram', {
                        photos2: imageArr,
                        user: req.user,
                        user_profilePicture: user_profilePicture,
                        data:data[0]
                     });
                  }
               });

            }
         }); //instagram.users.self
      } //user if ends
   });
});


app.get('/auth/instagram',
   passport.authenticate('instagram'),
   function(req, res) {
   });

app.get('/auth/facebook',
   function(req, res) {

      if (!req.query.code) {
         var authUrl = graph.getOauthUrl({
            "client_id": conf.client_id,
            "redirect_uri": conf.redirect_uri,
            "scope": conf.scope
         });

         if (!req.query.error) { //checks whether a user denied the app facebook login/permissions
            res.redirect(authUrl);
         } else { //req.query.error == 'access_denied'
            res.send('access denied');
         }
         return;
      }

      graph.authorize({
         "client_id": conf.client_id,
         "redirect_uri": conf.redirect_uri,
         "client_secret": conf.client_secret,
         "code": req.query.code
      }, function(err, facebookRes) {
         res.redirect('/facebook');
      });

   });


app.get('/auth/instagram/callback',
   passport.authenticate('instagram', {
      failureRedirect: '/login'
   }),
   function(req, res) {
      res.redirect('/instagram');
   });

app.get('/auth/facebook/callback',
   passport.authenticate('facebook', {
      failureRedirect: '/login'
   }),
   function(req, res) {
      res.redirect('/facebook');
   });

app.get('/logout', function(req, res) {
   req.logout();
   res.redirect('/login');
});

http.createServer(app).listen(app.get('port'), function() {
         console.log('Express server listening on port ' + app.get('port'));});
