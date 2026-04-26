import amqp from "amqplib";

// We need to import the exact types or TypesSript confuses amqpblib Connection and Channel types
type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;
type AmqpChannel = Awaited<ReturnType<AmqpConnection["createChannel"]>>;

export const ACCOUNT_EXCHANGE: string = "account_events";

export class RabbitMQService {
    private connection: AmqpConnection | null = null;
    private channel: AmqpChannel | null = null;

    constructor(private readonly url: string, private readonly reconnectTimeout: number) {
        this.url = url;
        this.reconnectTimeout = reconnectTimeout;
    }

    public async connect(): Promise<void> {
        if (this.connection) {
            return;
        }

        try {
            console.log("[RabbitMQ] Connecting to RabbitMQ");
            
            const conn = await amqp.connect(this.url);
            this.connection = conn;
            
            conn.on("error", (err: Error) => {
                console.error("[RabbitMQ] Failed to connect to RabbitMQ: ", err.message);
            });

            conn.on("close", () => {
                console.warn('[RabbitMQ] Connection to RabbitMQ has been closed. Attempting reconnect...');
                this.connection = null;
                this.channel = null;
                this.scheduleReconnect();
            });

            console.log("[RabbitMQ] Connection to RabbitMQ succesfully established");
            await this.createChannel();
        } catch (error) {
            console.error("[RabbitMQ] Failed to connect to RabbitMQ, retrying...", (error as Error).message);
            this.scheduleReconnect();
        }
    }

    /**
     * Creates a communication channel. If the channel closes unexpectedly, 
     * closes the connection to force a complete reconnection cycle.
     */
    private async createChannel(): Promise<void> {
        const conn = this.connection;
        if (!conn) {
            return;
        }

        try {
            const ch = await conn.createChannel();
            this.channel = ch;

            await ch.assertExchange(ACCOUNT_EXCHANGE, "topic", { durable: true });
            
            ch.on('error', (err: Error) => {
                console.error("[RabbitMQ] Error on the RabbitMQ channel:", err.message);
            });

            ch.on('close', () => {
                console.warn("[RabbitMQ] The RabbitMQ channel has been closed");
                if (this.connection) {
                    this.connection.close(); 
                }
            });

            console.log("[RabbitMQ] RabbitMQ Channel succesfully created");
        } catch (error) {
            console.error("[RabbitMQ] Failed to create the RabbitMQ Channel", (error as Error).message);
            if (this.connection) {
                this.connection.close();
            }
        }
    }

    private scheduleReconnect(): void {
        setTimeout(() => {
            this.connect();
        }, this.reconnectTimeout);
    }

    /**
     * Returns the current active channel. Use to publish or listen to incoming messages.
     */
    public getChannel(): AmqpChannel {
        if (!this.channel) {
            throw new Error("The RabbitMQ channel has not been initialized, please call Connect() first.");
        }
        return this.channel;
    }

    /**
     * Gracefully closes the connection to RabbitMQ
     */
    public async close(): Promise<void> {
        try {
            if (this.channel) {
                await this.channel.close();
            }
            if (this.connection) {
                await this.connection.close();
            }
            console.log("[RabbitMQ] Disconnected gracefully from RabbitMQ");
        } catch (error) {
            console.error("[RabbitMQ] Error on closing RabbitMQ connection", error);
        }
    }
}

export const rabbitMQService = new RabbitMQService(process.env.RABBITMQ_URL || "amqp://localhost:5672", 5000);
