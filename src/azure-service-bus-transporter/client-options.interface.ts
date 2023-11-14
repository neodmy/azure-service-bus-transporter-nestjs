import {ServiceBusClientOptions} from '@azure/service-bus';
import {Serializer, Deserializer} from '@nestjs/microservices';

export interface ClientOptions {
  connectionString: string,
  options?: ServiceBusClientOptions
  serializer?: Serializer
  deserializer?: Deserializer
}
