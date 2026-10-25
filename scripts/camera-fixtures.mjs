import {createDefaultPreset} from '../src/state/preset-schema.js';
import {createCameraSession,moveCamera,compileCamera,editCameraOutput} from '../src/camera/camera-model.js';
// Nonsexual, fully clothed synthetic controls. They borrow the tested camera/pose
// categories; they are NOT the private images' unchanged complete prompts.
export function cameraFixture(kind='front') {
  const rear=kind==='rear';
  const preset=createDefaultPreset({metadata:{name:`Camera comparison · ${kind} fixture`},params:{model:'nai-diffusion-5-full',effort:'high',width:1024,height:1024,steps:18,scale:5,cfg_rescale:0,sampler:'k_euler_ancestral',noise_schedule:'karras',seed:rear?12345679:12345678,n_samples:1,qualityPreset:'standard',ucPreset:0},prompt_parts:{base:'1girl, adult woman, fully clothed, anime illustration, window light, indoor room, potted plant, wooden chair',undesired:'text, watermark, lowres',characters:[{name:'Subject',prompt:rear?'from behind, three-quarter rear view, eye level, cowboy shot, standing, looking over shoulder, looking at viewer, long black ponytail, green blouse, blue jeans':'front view, eye level, cowboy shot, sitting sideways on a chair, leaning to the side, right hand behind head, left palm on the seat, looking at viewer, long brown hair, beige sweater, blue jeans',undesired:'text',centers:[{x:.5,y:.5}],position_mode:'auto'}]}});
  return createCameraSession({preset,source:{id:`synthetic-${kind}`,label:`${kind} nonsexual camera control`,reference_category:rear?'synthetic right-rear':'synthetic front'},confirmed:rear?{values:{yaw:135},evidence:{yaw:'user-confirmed category transferred to synthetic control'}}:{}});
}
export function correctionAt40(session,value=1.5){moveCamera(session,'yaw',40);const output=compileCamera(session).fields[session.field],item=output.expressions.find(e=>e.term==='bearing-1');editCameraOutput(session,session.field,output.text.slice(0,item.weightStart)+value+output.text.slice(item.weightEnd));return session;}
