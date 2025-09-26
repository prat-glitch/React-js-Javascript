new promise(function(resolve, reject)
{
    setTimeout(function()
{
    console.log("async task ");
}, 2000)
}).then(function()
{
    console.log("task 2 consumed");
})

console.log("hello");