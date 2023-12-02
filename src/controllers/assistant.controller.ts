import { Route, Body, Post, Controller } from 'tsoa';
import { handleUserInput } from '../services/assistant.service';

interface HandleUserInputRequest {
  userInput: string;
}

@Route('assistant')
export class AssistantController extends Controller {
  @Post('user-input')
  public async handleUserInput(@Body() requestBody: HandleUserInputRequest): Promise<string> {
    return handleUserInput(requestBody.userInput);
  }
}
