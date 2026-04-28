
export class UserRegisteredMsg {
    constructor(
        private readonly email: string,
        private readonly name: string,
        private readonly parentalSurname: string | undefined,
        private readonly maternalSurname: string | undefined,
        private readonly userId: string
    ) {
        this.email = email;
        this.name = name;
        this.parentalSurname = parentalSurname;
        this.maternalSurname = maternalSurname;
        this.userId = userId
    }
}
