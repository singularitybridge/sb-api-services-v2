import { Route, Body, Post, Controller, Get } from "tsoa";
import { generateAudio } from "../services/11labs.service";

interface GenerateAudioRequest {
  text: string;
}

@Route("audio")
export class AudioController extends Controller {
  @Post("generate")
  public async generateAudio(
    @Body() requestBody: GenerateAudioRequest
  ): Promise<string> {
    return (await generateAudio(requestBody.text)) || "error";
  }

  @Get("{id}")
  public async getAudio(id: string): Promise<string> {
    return id;
  }
}
