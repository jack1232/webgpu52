import { InitGPU, CreateGPUBuffer, CreateGPUBufferUint, CreateTransforms, CreateViewProjection, CreateAnimation } from './helper';
import sphereShader from './sphere.wgsl';
import cubeShader from './cube.wgsl';
import { GetTexture } from './texture-data';
import { SphereData, CubeData1 } from './vertex_data';
import { vec3, mat4 } from 'gl-matrix';
import "./site.css";

let ambientIntensity = 0.2;
let diffuseIntensity = 0.8;
let specularIntensity = 0.4;
let shininess = 30;
let specularColor = [1, 1, 1];
let isPhong = 0;
let isTwoSideLighting = 1;

export const CreateObjects = async () => {
    const gpu = await InitGPU();
    const device = gpu.device;

    // create vertex buffers
    const sphereData = SphereData(1.5, 70, 40);
    const numberOfVertices = (sphereData?.vertexData!).length/3;
    const vertexBuffer = CreateGPUBuffer(device, sphereData?.vertexData!);   
    const normalBuffer = CreateGPUBuffer(device, sphereData?.normalData!);
    const uvBuffer = CreateGPUBuffer(device, sphereData?.uvData!);

    //create cube vertices
    const cubeData = CubeData1();     
    const numberOfVertices2 = cubeData.indexData.length;   
    const vertexBuffer2 = CreateGPUBuffer(device, cubeData.vertexData);
    const indexBuffer2 = CreateGPUBufferUint(device, cubeData.indexData);
 
    const pipeline1 = device.createRenderPipeline({
        vertex: {
            module: device.createShaderModule({                    
                code: sphereShader
            }),
            entryPoint: "vs_main",
            buffers:[
                {
                    arrayStride: 12,
                    attributes: [{
                        shaderLocation: 0,
                        format: "float32x3",
                        offset: 0
                    }]
                },
                {
                    arrayStride: 12,
                    attributes: [{
                        shaderLocation: 1,
                        format: "float32x3",
                        offset: 0
                    }]
                },
                {
                    arrayStride: 8,
                    attributes: [{
                        shaderLocation: 2,
                        format: "float32x2",
                        offset: 0
                    }]
                }
            ]
        },
        fragment: {
            module: device.createShaderModule({                    
                code: sphereShader
            }),
            entryPoint: "fs_main",
            targets: [
                {
                    format: gpu.format as GPUTextureFormat
                }
            ]
        },
        primitive:{
            topology: "triangle-list",
        },
        depthStencil:{
            format: "depth24plus",
            depthWriteEnabled: true,
            depthCompare: "less"
        }
    });

    const pipeline2 = device.createRenderPipeline({
        vertex: {
            module: device.createShaderModule({                    
                code: cubeShader
            }),
            entryPoint: "vs_main",
            buffers:[
                {
                    arrayStride: 24,
                    attributes: [
                        {
                            shaderLocation: 0,
                            format: "float32x3",
                            offset: 0
                        },
                        {
                            shaderLocation: 1,
                            format: "float32x3",
                            offset: 12
                        }
                    ]
                }
            ]
        },
        fragment: {
            module: device.createShaderModule({                    
                code: cubeShader
            }),
            entryPoint: "fs_main",
            targets: [
                {
                    format: gpu.format
                }
            ]
        },
        primitive:{
            topology: "triangle-list",
        },
        depthStencil:{
            format: "depth24plus",
            depthWriteEnabled: true,
            depthCompare: "less"
        }
    });


    // create uniform data
    const vp = CreateViewProjection(gpu.canvas.width/gpu.canvas.height);
    let rotation = vec3.fromValues(0, 0, 0);    

    // for sphere
    let eyePosition = new Float32Array(vp.cameraOption.eye);
    let lightPosition = eyePosition;
    const normalMatrix = mat4.create();  
    const modelMatrix1 = mat4.create();
    const translateMatrix1 = mat4.create();
    CreateTransforms(translateMatrix1,[-2.5,-1.2,0.5], [0,0,0], [1,1,1]);

    const light_params = [
        ambientIntensity,
        diffuseIntensity,
        specularIntensity,
        shininess,
        specularColor,
        isPhong,
        isTwoSideLighting,
    ];

    // for cube
    const modelMatrix2 = mat4.create();
    const modelViewProjectionMatrix2 = mat4.create();
    const translateMatrix2 = mat4.create();
    CreateTransforms(translateMatrix2,[1,0.5,-2], [0,0,0], [1,1,1]);

    // create uniform buffer and layout for sphere
    const vertexUniformBuffer = device.createBuffer({
        size: 192,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const fragmentUniformBuffer = device.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const lightUniformBuffer = device.createBuffer({
        size: 36,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    device.queue.writeBuffer(vertexUniformBuffer, 0, vp.viewProjectionMatrix as ArrayBuffer);
    device.queue.writeBuffer(fragmentUniformBuffer, 0, lightPosition);
    device.queue.writeBuffer(fragmentUniformBuffer, 16, eyePosition);
    device.queue.writeBuffer(lightUniformBuffer, 0, new Float32Array((light_params as any).flat()));

    // get texture and sampler data
    const ts = await GetTexture(device, 'earth.png', 'repeat', 'repeat');
    const uniformBindGroup1 = device.createBindGroup({
        layout: pipeline1.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: vertexUniformBuffer,
                    offset: 0,
                    size: 192
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: fragmentUniformBuffer,
                    offset: 0,
                    size: 32
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: lightUniformBuffer,
                    offset: 0,
                    size: 36
                }
            },
            {
                binding: 3,
                resource: ts.sampler
            },
            {
                binding: 4,
                resource: ts.texture.createView()
            }         
        ]
    });

    // create uniform buffer and layout for cube
    const uniformBuffer2 = device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const uniformBindGroup2 = device.createBindGroup({
        layout: pipeline2.getBindGroupLayout(0),
        entries: [{
            binding: 0,
            resource: {
                buffer: uniformBuffer2,
                offset: 0,
                size: 64
            }
        }]
    });

    let textureView = gpu.context.getCurrentTexture().createView();
    const depthTexture = device.createTexture({
        size: [gpu.canvas.width, gpu.canvas.height, 1],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });

    const renderPassDescription = {
        colorAttachments: [{
            view: textureView,
            clearValue: { r: 0.2, g: 0.247, b: 0.314, a: 1.0 }, //background color
            loadOp: 'clear',
            storeOp: 'store'
        }],
        depthStencilAttachment: {
            view: depthTexture.createView(),
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: "store",
            /*stencilClearValue: 0,
            stencilLoadOp: 'clear',
            stencilStoreOp: "store"*/
        }
    };
    
    function draw() {
        //transforms on sphere
        mat4.rotate(
            modelMatrix1, 
            translateMatrix1, 
            1, 
            vec3.fromValues(Math.cos(rotation[0]*2), Math.sin(rotation[0]*2), 0)
        );            
        mat4.invert(normalMatrix, modelMatrix1);
        mat4.transpose(normalMatrix,normalMatrix);
        device.queue.writeBuffer(vertexUniformBuffer, 64, modelMatrix1 as ArrayBuffer);
        device.queue.writeBuffer(vertexUniformBuffer, 128, normalMatrix as ArrayBuffer);  
      
        //transforms on cube
        mat4.rotate(
            modelMatrix2, 
            translateMatrix2, 
            1, 
            vec3.fromValues(Math.cos(rotation[1]*2), 0, Math.sin(rotation[2]*2))
        );        
        mat4.multiply(modelViewProjectionMatrix2, vp.viewMatrix, modelMatrix2);
        mat4.multiply(modelViewProjectionMatrix2, vp.projectionMatrix, modelViewProjectionMatrix2);      
        device.queue.writeBuffer(uniformBuffer2, 0, modelViewProjectionMatrix2 as ArrayBuffer);  
  

        textureView = gpu.context.getCurrentTexture().createView();
        renderPassDescription.colorAttachments[0].view = textureView;
        const commandEncoder = device.createCommandEncoder();
        const renderPass = commandEncoder.beginRenderPass(renderPassDescription as GPURenderPassDescriptor);

        // draw sphere
        renderPass.setPipeline(pipeline1);
        renderPass.setVertexBuffer(0, vertexBuffer);
        renderPass.setVertexBuffer(1, normalBuffer);
        renderPass.setVertexBuffer(2, uvBuffer);
        renderPass.setBindGroup(0, uniformBindGroup1);       
        renderPass.draw(numberOfVertices);

        // draw cube
        renderPass.setPipeline(pipeline2);
        renderPass.setVertexBuffer(0, vertexBuffer2);
        renderPass.setIndexBuffer(indexBuffer2, 'uint32');
        renderPass.setBindGroup(0, uniformBindGroup2);
        renderPass.drawIndexed(numberOfVertices2);

        renderPass.end();
        device.queue.submit([commandEncoder.finish()]);
    }

    CreateAnimation(draw, rotation, true);
}

CreateObjects();

window.addEventListener('resize', function(){
    CreateObjects();
});