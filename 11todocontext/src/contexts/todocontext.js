import { createContext, useContext} from "react";

export const todocontext = createContext({
    todos:[
        {
            id:1,
            todo: "msg",
            completed:false,
        }
    ], 
     addtodo: (todo) =>{},
     updatedtodo: (id, todo) =>{},
     deletetodo: (id) => {},
     togglecomplete: (id) => {}
})

export const usetodo= () =>{
    return useContext(todocontext)
}

export const  todoprovider = todocontext.Provider