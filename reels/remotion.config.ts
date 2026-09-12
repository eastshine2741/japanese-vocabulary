import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setIPv4(true);
Config.setConcurrency(1);
Config.setDisallowParallelEncoding(true);
