import { BaseRpcContext } from '@nestjs/microservices/ctx-host/base-rpc.context';
import { ServiceBusReceiver } from '@azure/service-bus';

export class AzureServiceBusContext extends BaseRpcContext<ServiceBusReceiver> {
  constructor(args: ServiceBusReceiver) {
    super(args);
  }

  getReceiver(): ServiceBusReceiver {
    return this.args;
  }
}
