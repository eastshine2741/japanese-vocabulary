import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setIPv4(true);
Config.setConcurrency(1);
Config.setDisallowParallelEncoding(true);
// render-request.mjs 의 FFMPEG_THREADS 와 같은 값. 컨테이너 한도를 넘기지 않게 x264 스레드를 고정한다.
Config.overrideFfmpegCommand(({args}) => [...args.slice(0, -1), '-threads', '4', args[args.length - 1]]);
