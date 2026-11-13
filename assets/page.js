(function(){
  var r=document.documentElement;
  var t="light";
  try{if(localStorage.getItem("mb-theme")==="dark")t="dark";}catch(e){}
  r.setAttribute("data-mode",t);
  document.addEventListener("DOMContentLoaded",function(){
    var b=document.getElementById("btn-theme");
    if(!b)return;
    b.addEventListener("click",function(){
      var n=r.getAttribute("data-mode")==="dark"?"light":"dark";
      r.setAttribute("data-mode",n);
      try{localStorage.setItem("mb-theme",n);}catch(e){}
    });
  });
})();
