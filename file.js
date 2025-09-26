
// const promisefour= new Promise(function(resolve, reject)
// {
//     setTimeout(function()
// {
//     let error= true
//     if(!error)
//     {
//         resolve({username:"pratyush", password:123})
//     }
//     else reject(' ERROR:something went wrong ')
// },1000)
// })

// promisefour.then((user) =>
// {
//   console.log(user)
//   return user.username
// })
// .then((username) =>
// {
//   console.log(username)
// })
// .catch(function(error)
// {
//     console.log(error);
// })
// .finally(() =>
// {
//     console.log("the promise is either resolved or rejected ");
// })

// const promisefive= new Promise((resolve, reject) =>
// {
//     setTimeout(function()
//     {
//         let error= true
//         if(!error)
//         {
//             resolve({username:"JS", password:123})
//         }
//         else reject(' ERROR:JS went wrong ')
//     },1000)
// })
// async function consumepromisefive()
// {
//    try {
//     const response = await promisefive
//     console.log(response);
//    } catch (error) {
//      console.log(error);
//    }
// }
// consumepromisefive()




// fetch('https://api.github.com/users/hiteshchoudhary')
// .then((response) =>
// {
//  console.log(response);
//  return response.json()
// })
// .then((data) => 
//     {
//         console.log(data)
//     })
// .catch((error) => console.log("error")
// )
// setInterval(() =>
// {
//     console.log('I love u ');
// },1000) 

// // this is all about async await
// // console.log("hello world");
// // async function getitem()
// // {
// //  return "it's me ";
// // }
// // console.log(getitem());
// // const item = getitem();
// // item.then((res) =>
// // {
// //     return console.log(res);
// // })
// // const p = new Promise((resolve, reject) => {
// //     setTimeout(() => {      
// //         resolve("promise resolved");
// //     }, 2000);
// // });

// // const now = p.then((res) =>
// //     {
// //         document.getElementById("pp").innerHTML=res;
// //     })
// // const p = new Promise((resolve, reject) =>
// // {
// //     setTimeout(() => {
// //         resolve("promise reolved");
// //     },2000);
// // })

// //  async function get()
// // {
// //      const val = await p;
// //      console.log("hello");
// //      console.log(val);
// // }

// // get();
// const p1= new Promise((resolve, reject) =>
//     {
//         setTimeout(() => {
//             resolve("promise resolved")
//         }, 5000);
//     })
//     const p2= new Promise((resolve, reject) =>
//         {
//             setTimeout(() => {
//                 resolve("promise resolved")
//             }, 2000);
//         })
    
//     async function handle()
//     {
//         console.log("kjnfkj");
//         const val =await p1;
//         console.log("hello");
//         console.log(val);
    
//         const val2=await p2;
//         console.log("namaste");
//         console.log(val2);
//     }
//     handle();