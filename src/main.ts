import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import {MicroserviceOptions} from '@nestjs/microservices';
import {AzureServiceBusServer} from './azure-service-bus-transporter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>(
    {
      strategy: new AzureServiceBusServer({
        connectionString: process.env.SERVICE_BUS_CONNECTION_STRING,
      }),
    });

  await app.startAllMicroservices();
  await app.listen(3000);
}

bootstrap();
