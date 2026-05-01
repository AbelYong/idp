
export class UserRegisteredMsg {
    constructor(
        private readonly email: string,
        private readonly name: string,
        private readonly parentalSurname: string | undefined,
        private readonly maternalSurname: string | undefined,
        private readonly role: string,
        private readonly registratedAt: Date,
        private readonly userId: string
    ) {
        this.email = email;
        this.name = name;
        this.parentalSurname = parentalSurname;
        this.maternalSurname = maternalSurname;
        this.role = role;
        this.registratedAt = registratedAt;
        this.userId = userId
    }
}
