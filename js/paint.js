function buildNodes(name, attributes){

    var node = document.createElement(name);

    for(key in attributes){
        if(attributes[key])
            node.setAttribute(key, attributes[key]);
    }

    for(var i = 2; i < arguments.length; i++){
        var childNode = arguments[i];
        if(typeof childNode == "string")
            childNode = document.createTextNode(childNode);

        
        node.appendChild(childNode);
    }

    return node;
}

var controls = Object.create(null);

function createPaint(parent){

    var canvas = buildNodes("canvas", {width: 500, height: 300});
    var cx = canvas.getContext("2d");
    var toolWrap = buildNodes("div", null);

    for(control in controls){

        var toolbar = controls[control](cx);
        toolWrap.appendChild(toolbar);

    }    
        
    var panel = buildNodes("div", {class: "panel"}, canvas);
    var interface = buildNodes("div", null, panel, toolWrap);

    parent.appendChild(interface);

}

var tools = Object.create(null);

controls.Select = function(cx){
    var select = buildNodes("select");

    for(tool in tools){
        if(tools[tool]){
            var option = buildNodes("option", null, tool);
            select.appendChild(option);

        }
    }

    cx.canvas.addEventListener("mousedown", function(event){

        if(event.which == 1){
            tools[select.value](event, cx);
            event.preventDefault();
        }

    });

    return buildNodes("span", null, "tool: ", select);
}


tools.Line = function(event, cx, onEnd){

    cx.lineCap = "round";
    
    var pos = relativeCoord(event, cx.canvas);

    drag(function(event){

        cx.beginPath();
        cx.moveTo(pos.x, pos.y);
        pos = relativeCoord(event, cx.canvas);
        cx.lineTo(pos.x, pos.y);
        cx.stroke();
    }, onEnd);
    
}

tools.Erase = function(event, cx){

    cx.globalCompositeOperation = "destination-out";

    tools.Line(event, cx, function(){
        cx.globalCompositeOperation = "source-over";
    });
}

function relativeCoord(event, element){

   
    var rect = element.getBoundingClientRect();

    var x = Math.floor(event.clientX - rect.left);
    var y = Math.floor(event.clientY - rect.top);

    return {x: x, y: y};

}

function drag(onMove, onEnd){

    function end(event){
        removeEventListener("mousemove", onMove);
        removeEventListener("mouseup", end);

        if(onEnd)
            onEnd();

    }

    addEventListener("mousemove", onMove);
    addEventListener("mouseup", end);

}

controls.Color = function(cx){

    var input = buildNodes("input", {type: "color"});

    input.addEventListener("change", function(){
        cx.fillStyle = input.value;
        cx.strokeStyle = input.value;
    });

    return buildNodes("span", null, " Color: ", input);
}

controls.Size= function(cx){

    var input = buildNodes("select");
    var sizes = [1,2,3,4,5,8,12,25,35,50,75,100];

    sizes.forEach(function(size){

        var option = buildNodes("option", {value: size}, size + " px");
        input.appendChild(option);
    });

    input.addEventListener("change", function(){

        cx.lineWidth = input.value;

    });

    return buildNodes("span", null, "Size: ", input, " ");
}

controls.Save = function(cx){

    var link = buildNodes("a", {href: "/"}, "Save");

    function update(){
        try{
            link.href = cx.canvas.toDataURL();
        }catch(e){
            throw e;
        }
    }

    link.addEventListener("mouseover", update);
    link.addEventListener("focus", update);

    return buildNodes("span", null, link);

}

function load(cx, url){

    var image = document.createElement("img");
    image.addEventListener("load", function(){
        var color = cx.fillStyle;
        var size = cx.lineWidth;

        cx.canvas.width = image.width;
        cx.canvas.height = image.height;
        cx.drawImage(image,0,0);
        cx.fillStyle = color;
        cx.strokeStyle = color;
        cx.lineWidth = size;    
    });

    image.src = url;

}


controls.openFile = function(cx){

    var input = buildNodes("input", {type: "file"});
    input.addEventListener("change", function(){

        if (input.files.length == 0)
            return;

        var reader = new FileReader();
        reader.addEventListener("load", function(){

            load(cx, reader.result);
        });

        reader.readAsDataURL(input.files[0]);

    });

    return buildNodes("div", null, "Open file: ", input);

}

controls.openURL = function(cx){

    var input = buildNodes("input", {type: "text"});
    var button = buildNodes("button", {type: "submit"}, "load");
    var form = buildNodes("form", null, "Open URL: ", input, button);

    form.addEventListener("submit", function(event){

        event.preventDefault();
        load(cx, input.value);

    })

    return form;
}


tools.Text = function(event, cx){

    var text = prompt("Text: ", "");

    if(text){

        console.log(cx);
        var pos = relativeCoord(event, cx.canvas);

        cx.font = Math.max(10, cx.lineWidth) + "px sans-serif";
        cx.fillText(text, pos.x, pos.y);

    }


}

function randomPoint(radius){

    for(;;){

        var x = Math.random()*2 -1;
        var y = Math.random()*2 -1;

        if( x * x + y* y <= 1)
            return {x: x*radius, y: y*radius};
    }

}


tools.Spray = function(event, cx){

    var radius = cx.lineWidth/2;
    var area = Math.PI * radius * radius;
    var dots = Math.ceil(area/25);

    var pos = relativeCoord(event, cx.canvas);

    var spray = setInterval(function(){

        for(var i = 0; i < dots; i++){

            var point = randomPoint(radius);
            cx.fillRect(pos.x + point.x, pos.y + point.y, 1, 1);
        }
     }, 25);

    drag(function(event){
        pos = relativeCoord(event, cx.canvas);
    }, function(){
        clearInterval(spray);
    });
}

tools.Rectangle = function(event, cx){

    var pos = relativeCoord(event, cx.canvas);
    var absolutePos = {x: event.pageX, y: event.pageY};
    var endPos, absoluteEnd;
    var canvasCoord = cx.canvas.getBoundingClientRect();
    
    var limit = {x: canvasCoord.left + cx.canvas.width, y: canvasCoord.top + cx.canvas.height};

    var tempNode = document.createElement("div");
    tempNode.style.background = cx.fillStyle;
    tempNode.style.position = "absolute";
    document.body.appendChild(tempNode);


    drag(function(event){

        endPos = relativeCoord(event, cx.canvas);
        var absoluteEnd = {x: event.pageX, y: event.pageY};

        var tempRect = findRect(absolutePos, absoluteEnd);

        tempNode.style.left = tempRect.x + "px";
        

        if(tempRect.x + tempRect.width >= limit.x ) 
            tempNode.style.width = (limit.x - tempRect.x)+ "px";
        else if(tempRect.x < canvasCoord.left)
            tempNode.style.left = (canvasCoord.left)+ "px"; 
        else
            tempNode.style.width = tempRect.width + "px";
       

        tempNode.style.top = tempRect.y + "px";
       

        if(tempRect.y + tempRect.height >= limit.y )
            tempNode.style.height = (limit.y - tempRect.y) + "px";
        else if (tempRect.y < canvasCoord.top)
            tempNode.style.top = canvasCoord.top + "px"; 
        else
             tempNode.style.height = tempRect.height + "px";
           
        
        
         
    } ,function(){

        var rect = findRect(pos, endPos);
        document.body.removeChild(tempNode);
        cx.fillRect(rect.x, rect.y, rect.width, rect.height);
    });

}

function findRect(start, end){

    var width = Math.abs(end.x - start.x);
    var height = Math.abs(end.y - start.y); 
    var x = Math.min(start.x, end.x);
    var y = Math.min(start.y, end.y);
    

    return {x: x, y: y, width: width, height: height};
    
} 

tools.Pick = function(event, cx){

    var pos = relativeCoord(event, cx.canvas);
    var colors = pixelAt(cx, pos.x, pos.y);

    var rgb = "rgb(" + colors[0] + "," + colors[1] + "," +  colors[2]+ ")";  

    cx.fillStyle = rgb;
    cx.strokeStyle = rgb;

}

function pixelAt(cx, x, y) {
  var data = cx.getImageData(x, y, 1, 1);
  return data.data;
}

tools.Fill = function(event, cx){

    
    var width = cx.canvas.width;
    var height = cx.canvas.height;
    
    var pixels = cx.getImageData(0, 0, width, height).data;
    var colored = [];
    var start = relativeCoord(event, cx.canvas);
    var workList = [start];
    var color = getColor(pixels, start.x, start.y, width);

    while(true){

        var pos = workList.pop();
        var x = pos.x;
        var y = pos.y;
       

       if(!colored[x + y * width]){
           
            cx.fillRect(x, y, 1, 1);
            colored[x + y * width] = true;

            var neighboors = [[pixels[(x+1 + y*width)*4], pixels[(x+1 + y*width)*4+1], pixels[(x+1 + y*width)*4+2], pixels[(x+1 + y*width)*4+3]],               
            [pixels[(x + (y+1)*width)*4], pixels[(x + (y+1)*width)*4+1], pixels[(x + (y+1)*width)*4+2], pixels[(x + (y+1)*width)*4+3]],
            [pixels[(x-1 + y*width)*4], pixels[(x-1 + y*width)*4+1], pixels[(x-1 + y*width)*4+2], pixels[(x-1 + y*width)*4+3]],
            [pixels[(x + (y-1)*width)*4], pixels[(x + (y-1)*width)*4+1], pixels[(x + (y-1)*width)*4+2], pixels[(x + (y-1)*width)*4+3]]];


           if(compareArrays(neighboors[0],color) && x + 1 < width )
             workList.push({x: x+1, y: y }); 
           
           if(compareArrays(neighboors[1],color) && y + 1 < height)
              workList.push({x: x, y: y+1 });
           

           if(compareArrays(neighboors[2],color) && x - 1 >= 0)
              workList.push({x: x-1, y: y }); 
           
           if(compareArrays(neighboors[3],color) && y - 1 >= 0 )
               workList.push({x: x, y: y-1 }); 
           
            
       }

        if(workList.length == 0)
            return;
    }




    
}

function getColor(colorArray, x, y, width){

    var coord = (x + y*width)*4

    var pixColor = [colorArray[coord], colorArray[coord+1], colorArray[coord+2], colorArray[coord+3]];

    return pixColor;

}


function compareArrays(array, other){

    for(var i = 0; i < array.length; i++){
        if(array[i] != other[i])    
            return false;
    }
        
    return true;

}



function Vector(x,y){

    this.x = x;
    this.y = y;

}





createPaint(document.body);
