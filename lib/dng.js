var argv = require('optimist').argv, 
    fs = require('fs'),
    xml2js = require('xml2js'),
    cmd=require('node-cmd'),
    archiver = require('archiver'),    
    dnnfile = require('./dnnfilefactory');

var projects = [];
var command ;
var projectName;

main();

/**
 * Funcion de ejecucion principal
 */
function main(){   
    try
    {
        validateEnvironment();
        loadComands();

        if(command == 'build')
        {
            runCommandBuild();
        }
        else if(command == 'init')
        {
            runCommandInit();
        }  
    }catch(err) 
    {
        console.log(err);
    }
}

function validateEnvironment(){
    if(argv._.length == 0){
        console.log("No se ingreso ningun comando, consulte: dng --help");
        throw 0;
    }
}

function loadComands(){    
    if(argv._.length > 1)   projectName = argv._[1];
    command = argv._[0]   
}

/**
 * Crear un archivo dnn el el proyecto angular
 */
function runCommandInit(){
    dnnfile.buildDnnFiles(projectName);
}

function runCommandBuild(){
    if (!fs.existsSync('angular.json'))
    {
        console.log("'angular.json' file no found.");   
        throw "";  
    }

    var obj = JSON.parse(fs.readFileSync('angular.json', 'utf8'));    
   
    //Remove e2e projects
    Object.keys(obj.projects).forEach(function(element,index) {
       if(!isProuectE2E(element) && (!projectName || element == projectName ))
       {       
            projects.push({name:element,proj:obj.projects[element]});
       }
        
      });
      
      projects.forEach(function(element,index) {
          if(index == 0) console.log("Projects founds: " )
          console.log("--> " + element.name);
      });

      projects.forEach(function(element,index) {
        if (!fs.existsSync(element.proj.root + element.name +".dnn"))
        {
            console.log( element.name + " project does not have a dnn file.");        
            throw "";
        }
    });      
      
     if(projects.length > 0)  dngbuild(projects.pop());    
}

/**
 * Genera un un paquete instalable de dnn
 */
function dngbuild(element){  
    var buildCommand = 'ng build ' + element.name + (argv.prod?' --prod':'');
    console.log('Run  '  + buildCommand);         
    cmd.get(
        buildCommand,
        function(err, data, stderr){
            console.log(data)
            if(err)
            {      
                console.log(err);
                  throw ""               
            }
            
            if(!err)
            {
                loadProyect(element);
            }                
        }
    )
}

function isProuectE2E(element){
    var proyKeysSplit = element.split("-");
    if(proyKeysSplit[proyKeysSplit.length - 1] == 'e2e')
    {
       return true;
    }
    return false;
}

function loadProyect(element) {
        
    var moduleName = element.name;
    var outPutReourcesPath =  element.proj.architect.build.options.outputPath

    var parser = new xml2js.Parser();


    var dnnFile = fs.readFileSync(element.proj.root + element.name + '.dnn');
    

    parser.parseString(dnnFile, function (err, result) {  

        var moduleNameDnn = result.dotnetnuke.packages[0].package[0].$.name;
        var resourceFileName = result.dotnetnuke.packages[0].package[0].components[0].component[0].resourceFiles[0].resourceFile[0].name[0];
        
        createResourcesZip(outPutReourcesPath,resourceFileName,moduleName,element.proj.root + element.name);                            
    }); 
}

function createResourcesZip(outPutReourcesPath,resourceFileName,moduleName,dnnFilePath){   
    console.log('Creando dnnbuild'); 
    if (!fs.existsSync('dnnbuild')){        
        fs.mkdirSync('dnnbuild');
    }
    // create a file to stream archive data to.
    var output = fs.createWriteStream( 'dnnbuild/' + resourceFileName);
    var archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(output);
    archive.directory(outPutReourcesPath , false);
    output.on('close', function() {        
        console.log(archive.pointer() + ' total bytes');
        console.log('Archivos de recurso emaquetados'); 
        createModuleZip(moduleName,resourceFileName,dnnFilePath);
      });   
    archive.finalize();
}

function createModuleZip(moduleName,resourceFileName,dnnFilePath){
    console.log('Creando ' + moduleName + '.zip'); 
    var output = fs.createWriteStream( 'dnnbuild/' + moduleName + '_DnnInstall.zip');
    var archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(output);
    archive.file('dnnbuild/'+resourceFileName, { name: (resourceFileName+"").replace(".zip","") + '.zip' });
    archive.file(dnnFilePath + '.dnn', { name: moduleName + '.dnn' });
    output.on('close', function() {
        console.log(archive.pointer() + ' total bytes');
        console.log('Creando paquete instalable de DNN'); 
        fs.unlink('dnnbuild/'+resourceFileName, (err) => {      
            if (err) throw err;
        });
      });    
    archive.finalize();

    if(projects.length > 0)  dngbuild(projects.pop());  
}