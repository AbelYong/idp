import { rabbitMQService, ACCOUNT_EXCHANGE } from "./rabbitmq.js";
import { UserRegisteredMsg } from "./messages.js";

export function publishUserRegisteredEvent(userData: UserRegisteredMsg) {
    const channel = rabbitMQService.getChannel();

    if (!channel) {
        console.error("RabbitMQ channel has not been initialized");
        return;
    }

    const routingKey = "user.registered";
    const message  = Buffer.from(JSON.stringify(userData));

    channel.publish(ACCOUNT_EXCHANGE, routingKey, message, { persistent: true });
    console.log(`[EVENT] A user registration event has been published to the MQ: ${message}`);
};
