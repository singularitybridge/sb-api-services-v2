import { AuthenticatedSocket } from '../../types';
import { registerRpcMethod } from '../utils';
import { generateFluxImage } from '../../../../integrations/fluximage/fluximage.service';

// Register the RPC method
registerRpcMethod(
  'generateImage',
  async (socket: AuthenticatedSocket, params: any) => {
    if (!params?.prompt) {
      throw new Error('prompt is required');
    }

    const { prompt, width, height, filename } = params;
    const { companyId } = socket.decodedToken!;

    const imageUrl = await generateFluxImage(companyId, {
      prompt,
      width: width || 1024,
      height: height || 1024,
      filename,
    });

    return {
      imageUrl,
      timestamp: new Date().toISOString(),
    };
  },
);
